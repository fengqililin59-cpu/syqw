/**
 * @file 自动化规则（与 database/012 一致）。
 */
import { DataTypes, Model } from 'sequelize';

export class AutomationRule extends Model {
  static initModel(sequelize) {
    AutomationRule.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        name: { type: DataTypes.STRING(100), allowNull: false },
        trigger_type: { type: DataTypes.STRING(32), allowNull: false },
        trigger_config: { type: DataTypes.JSON, allowNull: false },
        action_type: { type: DataTypes.STRING(32), allowNull: false },
        action_config: { type: DataTypes.JSON, allowNull: false },
        enabled: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        modelName: 'AutomationRule',
        tableName: 'automation_rules',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
    return AutomationRule;
  }
}
