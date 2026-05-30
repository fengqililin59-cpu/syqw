import { DataTypes, Model } from 'sequelize';

export class SmsTask extends Model {
  static initModel(sequelize) {
    SmsTask.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        name: { type: DataTypes.STRING(100), allowNull: false },
        template_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        template_params: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
        filter_json: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
        total_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        sent_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        success_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        failed_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        status: {
          type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'done', 'failed', 'cancelled'),
          allowNull: false,
          defaultValue: 'draft',
        },
        scheduled_at: { type: DataTypes.DATE, allowNull: true },
        started_at: { type: DataTypes.DATE, allowNull: true },
        finished_at: { type: DataTypes.DATE, allowNull: true },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      },
      {
        sequelize,
        modelName: 'SmsTask',
        tableName: 'sms_tasks',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
    return SmsTask;
  }
}
