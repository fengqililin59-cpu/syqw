/**
 * @file 企业微信群发任务。
 */
import { DataTypes, Model } from 'sequelize';

export class BroadcastTask extends Model {
  static initModel(sequelize) {
    BroadcastTask.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        name: { type: DataTypes.STRING(100), allowNull: false },
        channel: {
          type: DataTypes.STRING(32),
          allowNull: false,
          defaultValue: 'wecom_mass',
          comment: 'wecom_mass / mock',
        },
        content: { type: DataTypes.TEXT, allowNull: false },
        msg_type: {
          type: DataTypes.ENUM('text', 'image', 'link', 'miniprogram'),
          allowNull: false,
          defaultValue: 'text',
        },
        filter_json: { type: DataTypes.JSON, allowNull: true },
        status: {
          type: DataTypes.STRING(24),
          allowNull: false,
          defaultValue: 'draft',
        },
        scheduled_at: { type: DataTypes.DATE, allowNull: true },
        started_at: { type: DataTypes.DATE, allowNull: true },
        finished_at: { type: DataTypes.DATE, allowNull: true },
        stats_json: { type: DataTypes.JSON, allowNull: true },
        wecom_msgid: { type: DataTypes.STRING(64), allowNull: true },
        send_fail_detail: { type: DataTypes.JSON, allowNull: true },
        is_sync_completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        error_message: { type: DataTypes.STRING(500), allowNull: true },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        modelName: 'BroadcastTask',
        tableName: 'broadcast_tasks',
        underscored: true,
      },
    );
    return BroadcastTask;
  }
}
