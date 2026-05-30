/**
 * @file 群消息发送日志模型。
 */
import { DataTypes, Model } from 'sequelize';

export class GroupSendLog extends Model {
  static initModel(sequelize) {
    GroupSendLog.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        group_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        sop_task_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        msg_type: { type: DataTypes.STRING(32), allowNull: false },
        content_json: { type: DataTypes.JSON, allowNull: false },
        status: {
          type: DataTypes.ENUM('pending', 'sent', 'failed'),
          allowNull: false,
          defaultValue: 'pending',
        },
        sent_at: { type: DataTypes.DATE, allowNull: true },
        error_msg: { type: DataTypes.STRING(500), allowNull: true },
      },
      {
        sequelize,
        modelName: 'GroupSendLog',
        tableName: 'group_send_logs',
        underscored: true,
        timestamps: false,
      },
    );
    return GroupSendLog;
  }
}
