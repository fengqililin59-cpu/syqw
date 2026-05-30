/**
 * @file 统一收件箱消息。
 */
import { DataTypes, Model } from 'sequelize';

export class InboxMessage extends Model {
  static initModel(sequelize) {
    InboxMessage.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        thread_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        channel_message_id: { type: DataTypes.STRING(96), allowNull: false },
        direction: { type: DataTypes.STRING(16), allowNull: false },
        sender_role: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'customer' },
        content: { type: DataTypes.TEXT, allowNull: true },
        msg_type: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'text' },
        risk_level: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'p0' },
        raw_payload: { type: DataTypes.JSON, allowNull: true },
      },
      {
        sequelize,
        modelName: 'InboxMessage',
        tableName: 'inbox_messages',
        underscored: true,
        updatedAt: false,
      },
    );
    return InboxMessage;
  }
}
