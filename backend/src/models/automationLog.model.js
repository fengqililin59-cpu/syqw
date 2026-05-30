/**
 * @file 自动化执行日志（database/014）。
 */
import { DataTypes, Model } from 'sequelize';

export class AutomationLog extends Model {
  static initModel(sequelize) {
    AutomationLog.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        rule_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        trigger_type: { type: DataTypes.STRING(32), allowNull: true },
        action_taken: { type: DataTypes.STRING(32), allowNull: false },
        status: { type: DataTypes.STRING(20), allowNull: false },
        message_preview: { type: DataTypes.STRING(500), allowNull: true },
        detail_json: { type: DataTypes.JSON, allowNull: true },
        executed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      },
      {
        sequelize,
        modelName: 'AutomationLog',
        tableName: 'automation_logs',
        timestamps: false,
      },
    );
    return AutomationLog;
  }
}
