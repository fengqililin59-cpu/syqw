/**
 * @file 群发任务受众明细。
 */
import { DataTypes, Model } from 'sequelize';

export class BroadcastTaskRecipient extends Model {
  static initModel(sequelize) {
    BroadcastTaskRecipient.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        broadcast_task_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        send_status: {
          type: DataTypes.STRING(24),
          allowNull: false,
          defaultValue: 'pending',
        },
        error_message: { type: DataTypes.STRING(255), allowNull: true },
        sent_at: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        modelName: 'BroadcastTaskRecipient',
        tableName: 'broadcast_task_recipients',
        underscored: true,
        updatedAt: false,
      },
    );
    return BroadcastTaskRecipient;
  }
}
