/**
 * @file 审批模板模型 — 定义审批流程的类型和步骤。
 * steps 为 JSON 数组，每个元素：{ order, approver_id?, approver_role?, step_name }
 */
import { DataTypes, Model } from 'sequelize';

export class ApprovalTemplate extends Model {
  static initModel(sequelize) {
    ApprovalTemplate.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        name: { type: DataTypes.STRING(100), allowNull: false },
        description: { type: DataTypes.STRING(500), allowNull: true },
        steps: {
          type: DataTypes.JSON,
          allowNull: false,
          comment: '审批步骤数组 [{order, approver_id?, approver_role?, step_name}]',
        },
        is_active: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        modelName: 'ApprovalTemplate',
        tableName: 'approval_templates',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
    return ApprovalTemplate;
  }
}
