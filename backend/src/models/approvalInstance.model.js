/**
 * @file 审批实例模型 — 具体的审批申请记录。
 * steps_snapshot 为提交时冻结的步骤快照，每步追加审批结果。
 */
import { DataTypes, Model } from 'sequelize';

export class ApprovalInstance extends Model {
  static initModel(sequelize) {
    ApprovalInstance.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        template_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        title: { type: DataTypes.STRING(255), allowNull: false },
        applicant_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        related_type: { type: DataTypes.STRING(32), allowNull: true, comment: '关联业务类型(customer/deal/order/refund)' },
        related_id: { type: DataTypes.STRING(64), allowNull: true, comment: '关联业务ID' },
        status: {
          type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
          allowNull: false,
          defaultValue: 'pending',
        },
        current_step: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, comment: '当前审批步骤序号(从0开始)' },
        steps_snapshot: {
          type: DataTypes.JSON,
          allowNull: false,
          comment: '提交时冻结的步骤快照 [{order,approver_id,step_name,status,comment,action_user_id,action_at}]',
        },
        submitted_at: { type: DataTypes.DATE, allowNull: true },
        completed_at: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        modelName: 'ApprovalInstance',
        tableName: 'approval_instances',
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          { fields: ['tenant_id', 'status'] },
          { fields: ['tenant_id', 'applicant_user_id'] },
          { fields: ['template_id'] },
          { fields: ['related_type', 'related_id'] },
        ],
      },
    );
    return ApprovalInstance;
  }
}
