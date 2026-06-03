const { CustomerSegment, CustomerSegmentMember, Customer, sequelize } = require('../models/index.js');
const { Op, QueryTypes } = require('sequelize');

class CustomerSegmentService {

  // ============ CRUD ============

  async list(tenantId) {
    return CustomerSegment.findAll({
      where: { tenant_id: tenantId },
      include: [{ association: 'creator', attributes: ['id', 'name'] }],
      order: [['updated_at', 'DESC']],
    });
  }

  async getById(tenantId, id) {
    const seg = await CustomerSegment.findOne({
      where: { id, tenant_id: tenantId },
      include: [{ association: 'creator', attributes: ['id', 'name'] }],
    });
    if (!seg) throw new Error('分组不存在');
    return seg;
  }

  async create(tenantId, data) {
    const seg = await CustomerSegment.create({
      tenant_id: tenantId,
      name: data.name,
      description: data.description || '',
      rules: data.rules || [],
      match_type: data.match_type || 'all',
      color_tag: data.color_tag || '#4F46E5',
      icon: data.icon || '',
      is_auto_refresh: data.is_auto_refresh || false,
      created_by: data.created_by,
    });
    // 新分组自动执行一次成员匹配
    await this.refreshMembers(tenantId, seg.id);
    return this.getById(tenantId, seg.id);
  }

  async update(tenantId, id, data) {
    const seg = await this.getById(tenantId, id);
    const updatable = ['name', 'description', 'rules', 'match_type', 'color_tag', 'icon', 'is_auto_refresh'];
    for (const k of updatable) {
      if (data[k] !== undefined) seg[k] = data[k];
    }
    await seg.save();
    // 规则变更后自动刷新成员
    if (data.rules !== undefined || data.match_type !== undefined) {
      await this.refreshMembers(tenantId, id);
    }
    return this.getById(tenantId, id);
  }

  async delete(tenantId, id) {
    const seg = await this.getById(tenantId, id);
    await CustomerSegmentMember.destroy({ where: { segment_id: id } });
    await seg.destroy();
  }

  // ============ 成员管理 ============

  async getMembers(tenantId, segmentId, { page = 1, pageSize = 20 } = {}) {
    const offset = (page - 1) * pageSize;
    const { count, rows } = await CustomerSegmentMember.findAndCountAll({
      where: { segment_id: segmentId, tenant_id: tenantId },
      include: [{
        association: 'customer',
        attributes: ['id', 'name', 'phone', 'stage', 'tags', 'source', 'assigned_to', 'created_at'],
      }],
      order: [['added_at', 'DESC']],
      limit: pageSize,
      offset,
    });
    return { total: count, list: rows, page, pageSize };
  }

  // ============ 规则匹配引擎（核心） ============

  /**
   * 根据分组的规则，刷新成员列表（先清空再重建）
   */
  async refreshMembers(tenantId, segmentId) {
    const seg = await this.getById(tenantId, segmentId);
    const rules = seg.rules || [];
    if (rules.length === 0) {
      await CustomerSegmentMember.destroy({ where: { segment_id: segmentId } });
      await seg.update({ member_count: 0, last_refreshed_at: new Date() });
      return { matched: 0 };
    }

    const whereClauses = [];
    const joinClauses = [];
    const params = { tenantId };

    // 构建每个规则的 SQL 片段
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const clause = this._buildRuleClause(r, i, joinClauses, params);
      if (clause) whereClauses.push(clause);
    }

    if (whereClauses.length === 0) {
      await CustomerSegmentMember.destroy({ where: { segment_id: segmentId } });
      await seg.update({ member_count: 0, last_refreshed_at: new Date() });
      return { matched: 0 };
    }

    const combinator = seg.match_type === 'any' ? ' OR ' : ' AND ';
    const whereSQL = '(' + whereClauses.join(combinator) + ')';
    const joinSQL = joinClauses.join('\n');

    // 先找出匹配的客户 ID
    const [rows] = await sequelize.query(`
      SELECT DISTINCT c.id
      FROM customers c
      ${joinSQL}
      WHERE c.tenant_id = :tenantId AND ${whereSQL}
    `, { replacements: params, type: QueryTypes.SELECT, raw: true });

    const matchedIds = (rows || []).map(r => r.id);

    // 先清空再批量插入
    await CustomerSegmentMember.destroy({ where: { segment_id: segmentId } });

    if (matchedIds.length > 0) {
      const members = matchedIds.map(cid => ({
        segment_id: segmentId,
        customer_id: cid,
        tenant_id: tenantId,
      }));
      // 批量插入（每批 200 条）
      for (let i = 0; i < members.length; i += 200) {
        await CustomerSegmentMember.bulkCreate(members.slice(i, i + 200), { ignoreDuplicates: true });
      }
    }

    await seg.update({ member_count: matchedIds.length, last_refreshed_at: new Date() });
    return { matched: matchedIds.length };
  }

  /**
   * 批量刷新所有自动刷新分组
   */
  async refreshAllAuto(tenantId) {
    const segments = await CustomerSegment.findAll({
      where: { tenant_id: tenantId, is_auto_refresh: true },
    });
    const results = [];
    for (const seg of segments) {
      const r = await this.refreshMembers(tenantId, seg.id);
      results.push({ id: seg.id, name: seg.name, ...r });
    }
    return results;
  }

  /**
   * 预览规则匹配结果（不保存）
   */
  async previewRules(tenantId, rules, matchType = 'all') {
    if (!rules || rules.length === 0) return { total: 0, sample: [] };

    const whereClauses = [];
    const joinClauses = [];
    const params = { tenantId };

    for (let i = 0; i < rules.length; i++) {
      const clause = this._buildRuleClause(rules[i], i, joinClauses, params);
      if (clause) whereClauses.push(clause);
    }

    const combinator = matchType === 'any' ? ' OR ' : ' AND ';
    const whereSQL = '(' + whereClauses.join(combinator) + ')';
    const joinSQL = joinClauses.join('\n');

    const [countRow] = await sequelize.query(`
      SELECT COUNT(DISTINCT c.id) AS cnt
      FROM customers c
      ${joinSQL}
      WHERE c.tenant_id = :tenantId AND ${whereSQL}
    `, { replacements: params, type: QueryTypes.SELECT });

    const sample = await sequelize.query(`
      SELECT DISTINCT c.id, c.name, c.phone, c.stage, c.tags
      FROM customers c
      ${joinSQL}
      WHERE c.tenant_id = :tenantId AND ${whereSQL}
      LIMIT 10
    `, { replacements: params, type: QueryTypes.SELECT });

    return { total: Number(countRow.cnt) || 0, sample };
  }

  // ============ 规则子句构建器 ============

  _buildRuleClause(rule, idx, joinClauses, params) {
    const { field, operator, value } = rule;
    const alias = `_${idx}`;

    switch (field) {
      // --- 客户主表字段 ---
      case 'stage':
        params[`v${idx}`] = value;
        return operator === 'neq'
          ? `c.stage != :v${idx}`
          : operator === 'in'
            ? `c.stage IN (:v${idx})`
            : `c.stage = :v${idx}`;

      case 'source':
        params[`v${idx}`] = value;
        return operator === 'neq'
          ? `c.source != :v${idx}`
          : `c.source = :v${idx}`;

      case 'assigned_to':
        params[`v${idx}`] = value;
        return operator === 'neq'
          ? `c.assigned_to != :v${idx}`
          : `c.assigned_to = :v${idx}`;

      // --- 标签（JSON数组字段） ---
      case 'tags':
        params[`v${idx}`] = `%${value}%`;
        if (operator === 'not_contains') {
          return `(c.tags IS NULL OR c.tags NOT LIKE :v${idx})`;
        }
        return `c.tags LIKE :v${idx}`;

      // --- 时间相关 ---
      case 'last_activity_days':
        params[`v${idx}`] = value;
        return `DATEDIFF(NOW(), c.updated_at) ${this._op(operator)} :v${idx}`;

      case 'created_days':
        params[`v${idx}`] = value;
        return `DATEDIFF(NOW(), c.created_at) ${this._op(operator)} :v${idx}`;

      // --- 订单统计（需要 JOIN customer_orders） ---
      case 'order_count': {
        joinClauses.push(`LEFT JOIN customer_orders o${alias} ON o${alias}.customer_id = c.id AND o${alias}.tenant_id = c.tenant_id`);
        params[`v${idx}`] = value;
        return `COALESCE((SELECT COUNT(*) FROM customer_orders co WHERE co.customer_id = c.id AND co.tenant_id = c.tenant_id), 0) ${this._op(operator)} :v${idx}`;
      }

      case 'total_spent': {
        params[`v${idx}`] = value;
        return `COALESCE((SELECT SUM(amount) FROM customer_orders co WHERE co.customer_id = c.id AND co.tenant_id = c.tenant_id AND co.status = 'paid'), 0) ${this._op(operator)} :v${idx}`;
      }

      // --- 自定义字段 ---
      case 'custom_field': {
        const fieldId = parseInt(value.field_id);
        const fieldVal = value.value;
        joinClauses.push(`
          LEFT JOIN tenant_customer_field_values fv${alias} ON fv${alias}.customer_id = c.id
            AND fv${alias}.field_def_id = ${fieldId}
        `);
        params[`v${idx}`] = `%${fieldVal}%`;
        if (operator === 'neq') {
          return `(fv${alias}.field_value IS NULL OR fv${alias}.field_value NOT LIKE :v${idx})`;
        }
        return `fv${alias}.field_value LIKE :v${idx}`;
      }

      default:
        return null;
    }
  }

  _op(operator) {
    const map = { eq: '=', neq: '!=', gt: '>', lt: '<', gte: '>=', lte: '<=' };
    return map[operator] || '=';
  }
}

module.exports = new CustomerSegmentService();
