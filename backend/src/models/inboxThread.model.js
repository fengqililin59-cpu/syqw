/**
 * @file 统一收件箱会话线程。
 */
import { DataTypes, Model } from 'sequelize';

export class InboxThread extends Model {
  static initModel(sequelize) {
    InboxThread.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        channel_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        external_thread_key: { type: DataTypes.STRING(128), allowNull: false },
        assignee_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        sales_stage: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'new' },
        status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'open' },
        lead_score: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        last_message_at: { type: DataTypes.DATE, allowNull: true },
        last_customer_message_at: { type: DataTypes.DATE, allowNull: true },
        metadata_json: { type: DataTypes.JSON, allowNull: true },
      },
      {
        sequelize,
        modelName: 'InboxThread',
        tableName: 'inbox_threads',
        underscored: true,
      },
    );
    return InboxThread;
  }
}
