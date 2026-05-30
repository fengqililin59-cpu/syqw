/**
 * @file 收件箱关联的跟进任务。
 */
import { DataTypes, Model } from 'sequelize';

export class InboxFollowupTask extends Model {
  static initModel(sequelize) {
    InboxFollowupTask.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        thread_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        title: { type: DataTypes.STRING(200), allowNull: false },
        due_at: { type: DataTypes.DATE, allowNull: true },
        owner_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'open' },
      },
      {
        sequelize,
        modelName: 'InboxFollowupTask',
        tableName: 'inbox_followup_tasks',
        underscored: true,
      },
    );
    return InboxFollowupTask;
  }
}
