/**
 * @file 流程直发客户消息审计日志。
 */
import { DataTypes, Model } from 'sequelize';

export class AutoMessageLog extends Model {
  static initModel(sequelize) {
    AutoMessageLog.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        flow_run_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        node_key: { type: DataTypes.STRING(64), allowNull: true },
        content: { type: DataTypes.TEXT, allowNull: false },
        wework_errcode: { type: DataTypes.INTEGER, allowNull: true },
        wework_errmsg: { type: DataTypes.STRING(500), allowNull: true },
        skipped_reason: { type: DataTypes.STRING(64), allowNull: true },
        via: { type: DataTypes.STRING(32), allowNull: true },
      },
      {
        sequelize,
        modelName: 'AutoMessageLog',
        tableName: 'auto_message_logs',
        underscored: true,
        updatedAt: false,
      },
    );
    return AutoMessageLog;
  }
}
