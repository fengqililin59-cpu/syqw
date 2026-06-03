/**
 * @file 进件报件服务
 */
import {
  LoanApplication,
  LoanProduct,
  Customer,
  User,
  LoanMaterial,
  CommissionRule,
  CommissionRecord,
  Tenant,
  sequelize,
} from '../models/index.js'
import { Op } from 'sequelize'
import { HttpError } from '../utils/httpError.js'

/**
 * 生成进件编号：LP + 日期 + 6位序列号
 */
async function generateAppNo(tenantId) {
  const today = new Date()
  const dateStr =
    String(today.getFullYear()) +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0')
  const prefix = `LP${dateStr}`

  const [result] = await sequelize.query(
    `SELECT COUNT(*) AS cnt FROM loan_applications
     WHERE tenant_id = ? AND application_no LIKE ?`,
    { replacements: [tenantId, `${prefix}%`], type: sequelize.QueryTypes.SELECT },
  )
  const cnt = (result?.cnt || 0) + 1
  return `${prefix}${String(cnt).padStart(6, '0')}`
}

/** 获取进件列表 */
export async function listApplications(auth, query = {}) {
  const {
    status,
    customer_id,
    handled_by,
    keyword,
    page = 1,
    pageSize = 20,
  } = query

  const where = { tenant_id: auth.tenantId }
  if (status) where.status = status
  if (customer_id) where.customer_id = customer_id
  if (handled_by) where.handled_by = handled_by
  if (keyword) {
    where[Op.or] = [
      { application_no: { [Op.like]: `%${keyword}%` } },
      sequelize.where(
        sequelize.col('customer.name'),
        { [Op.like]: `%${keyword}%` },
      ),
    ]
  }

  const offset = (Math.max(1, Number(page)) - 1) * Number(pageSize)
  const { rows, count } = await LoanApplication.findAndCountAll({
    where,
    include: [
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      { model: LoanProduct, as: 'product', attributes: ['id', 'name', 'institution'] },
      { model: User, as: 'handler', attributes: ['id', 'name'] },
    ],
    order: [['created_at', 'DESC']],
    limit: Number(pageSize),
    offset,
  })

  return { list: rows, total: count, page: Number(page), pageSize: Number(pageSize) }
}

/** 获取进件详情 */
export async function getApplication(auth, id) {
  const app = await LoanApplication.findOne({
    where: { id, tenant_id: auth.tenantId },
    include: [
      { model: Customer, as: 'customer' },
      { model: LoanProduct, as: 'product' },
      { model: User, as: 'handler', attributes: ['id', 'name', 'phone'] },
      { model: LoanMaterial, as: 'materials' },
      { model: CommissionRecord, as: 'commissionRecords', include: [{ model: User, as: 'user', attributes: ['id', 'name'] }] },
    ],
  })
  if (!app) throw new HttpError(404, '进件记录不存在')
  return app
}

/** 新建进件 */
export async function createApplication(auth, body) {
  const { customer_id, product_id, applied_amount, applied_term, remark } = body

  // 验证客户存在
  const customer = await Customer.findOne({
    where: { id: customer_id, tenant_id: auth.tenantId },
  })
  if (!customer) throw new HttpError(404, '客户不存在')

  // 验证产品存在（可选）
  if (product_id) {
    const product = await LoanProduct.findOne({
      where: {
        id: product_id,
        [Op.or]: [{ tenant_id: null }, { tenant_id: auth.tenantId }],
      },
    })
    if (!product) throw new HttpError(404, '产品不存在')
  }

  const application_no = await generateAppNo(auth.tenantId)

  const app = await LoanApplication.create({
    tenant_id: auth.tenantId,
    customer_id,
    product_id: product_id || null,
    application_no,
    applied_amount: applied_amount || 0,
    applied_term: applied_term || null,
    status: 'collecting',
    handled_by: auth.userId,
    remark: remark || null,
  })

  return getApplication(auth, app.id)
}

/** 更新进件 */
export async function updateApplication(auth, id, body) {
  const app = await LoanApplication.findOne({
    where: { id, tenant_id: auth.tenantId },
  })
  if (!app) throw new HttpError(404, '进件记录不存在')

  const allowed = [
    'product_id',
    'applied_amount',
    'applied_term',
    'status',
    'approved_amount',
    'approved_rate',
    'approved_term',
    'rejection_reason',
    'handled_by',
    'remark',
  ]

  const data = {}
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key]
  }

  // 状态流转自动填时间
  if (data.status === 'submitted' && !app.submitted_at) {
    data.submitted_at = new Date()
  }
  if (data.status === 'disbursed' && !app.disbursed_at) {
    data.disbursed_at = new Date()
    data.disbursed_amount = data.disbursed_amount || data.approved_amount || data.applied_amount
    // 触发佣金计算
    setTimeout(() => calcCommission(auth, app.id).catch(() => {}), 0)
  }

  await app.update(data)
  return getApplication(auth, id)
}

/** 删除进件 */
export async function deleteApplication(auth, id) {
  const app = await LoanApplication.findOne({
    where: { id, tenant_id: auth.tenantId },
  })
  if (!app) throw new HttpError(404, '进件记录不存在')
  if (['approved', 'disbursed'].includes(app.status)) {
    throw new HttpError(400, '已审批或已放款的进件不能删除')
  }
  await app.destroy()
  return { success: true }
}

/** 提交进件（改状态为 submitted） */
export async function submitApplication(auth, id) {
  const app = await LoanApplication.findOne({
    where: { id, tenant_id: auth.tenantId },
  })
  if (!app) throw new HttpError(404, '进件记录不存在')
  if (app.status !== 'collecting') {
    throw new HttpError(400, '当前状态不允许提交')
  }
  await app.update({
    status: 'submitted',
    submitted_at: new Date(),
  })
  return getApplication(auth, id)
}

/** 审批通过 */
export async function approveApplication(auth, id, body) {
  const app = await LoanApplication.findOne({
    where: { id, tenant_id: auth.tenantId },
  })
  if (!app) throw new HttpError(404, '进件记录不存在')
  await app.update({
    status: 'approved',
    approved_amount: body.approved_amount || app.applied_amount,
    approved_rate: body.approved_rate || null,
    approved_term: body.approved_term || app.applied_term,
  })
  return getApplication(auth, id)
}

/** 审批驳回 */
export async function rejectApplication(auth, id, body) {
  const app = await LoanApplication.findOne({
    where: { id, tenant_id: auth.tenantId },
  })
  if (!app) throw new HttpError(404, '进件记录不存在')
  await app.update({
    status: 'rejected',
    rejection_reason: body.rejection_reason || '未说明原因',
  })
  return getApplication(auth, id)
}

/** 确认放款 */
export async function disburseApplication(auth, id, body) {
  const app = await LoanApplication.findOne({
    where: { id, tenant_id: auth.tenantId },
  })
  if (!app) throw new HttpError(404, '进件记录不存在')
  if (app.status !== 'approved') {
    throw new HttpError(400, '只有已审批的进件可以确认放款')
  }
  await app.update({
    status: 'disbursed',
    disbursed_at: new Date(),
    disbursed_amount: body.disbursed_amount || app.approved_amount,
  })
  // 触发佣金计算
  setTimeout(() => calcCommission(auth, id).catch(() => {}), 0)
  return getApplication(auth, id)
}

/**
 * 佣金计算（内部方法）
 */
async function calcCommission(auth, applicationId) {
  try {
    const app = await LoanApplication.findOne({
      where: { id: applicationId, tenant_id: auth.tenantId },
    })
    if (!app || !app.disbursed_amount) return

    const rules = await CommissionRule.findAll({
      where: { tenant_id: auth.tenantId, status: 'active' },
    })

    if (!rules.length) return

    // 找到经办人
    const handlerId = app.handled_by
    if (!handlerId) return

    const disbursedAmount = parseFloat(app.disbursed_amount) * 10000 // 万元转元

    for (const rule of rules) {
      // 检查产品匹配
      if (rule.product_id && rule.product_id !== app.product_id) continue
      // 检查最低放款门槛
      if (rule.min_loan_amount && parseFloat(app.disbursed_amount) < parseFloat(rule.min_loan_amount)) continue

      let commissionAmount = 0
      if (rule.calc_type === 'percent' && rule.rate) {
        commissionAmount = disbursedAmount * (parseFloat(rule.rate) / 100)
      } else if (rule.calc_type === 'fixed' && rule.fixed_amount) {
        commissionAmount = parseFloat(rule.fixed_amount)
      }

      if (commissionAmount > 0) {
        await CommissionRecord.create({
          tenant_id: auth.tenantId,
          application_id: applicationId,
          user_id: handlerId,
          rule_id: rule.id,
          amount: Math.round(commissionAmount * 100) / 100,
          base_amount: disbursedAmount,
          rate: rule.rate,
          status: 'pending',
        })
      }
    }
  } catch (err) {
    console.error('[Commission] 计算失败:', err.message)
  }
}

/** 获取客户的所有进件记录 */
export async function getCustomerApplications(auth, customerId) {
  const apps = await LoanApplication.findAll({
    where: { tenant_id: auth.tenantId, customer_id: customerId },
    include: [
      { model: LoanProduct, as: 'product', attributes: ['id', 'name', 'institution'] },
      { model: User, as: 'handler', attributes: ['id', 'name'] },
    ],
    order: [['created_at', 'DESC']],
  })
  return apps
}

/** 上传进件材料 */
export async function addMaterial(auth, applicationId, fileData) {
  const app = await LoanApplication.findOne({
    where: { id: applicationId, tenant_id: auth.tenantId },
  })
  if (!app) throw new HttpError(404, '进件记录不存在')

  const material = await LoanMaterial.create({
    tenant_id: auth.tenantId,
    application_id: applicationId,
    doc_type: fileData.doc_type || '其他',
    file_name: fileData.file_name,
    file_url: fileData.file_url,
    file_size: fileData.file_size || null,
    uploaded_by: auth.userId,
  })
  return material
}

/** 删除进件材料 */
export async function deleteMaterial(auth, materialId) {
  const material = await LoanMaterial.findOne({
    where: { id: materialId },
    include: [{ model: LoanApplication, as: 'application', attributes: ['tenant_id'] }],
  })
  if (!material || material.application.tenant_id !== auth.tenantId) {
    throw new HttpError(404, '材料不存在或无权限')
  }
  await material.destroy()
  return { success: true }
}
