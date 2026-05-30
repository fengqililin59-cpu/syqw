/**
 * @file 裂变奖励任务队列（异步重试 + 延迟发放）。
 */
import { DataTypes, Model } from 'sequelize';

export class CampaignRewardJob extends Model {
  static initModel(sequelize) {
    CampaignRewardJob.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        campaign_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        enrollment_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        milestone_index: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        reward_type: { type: DataTypes.STRING(32), allowNull: false },
        reward_payload: { type: DataTypes.JSON, allowNull: true },
        status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'pending' },
        attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        max_attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 5 },
        scheduled_at: { type: DataTypes.DATE, allowNull: true },
        locked_at: { type: DataTypes.DATE, allowNull: true },
        locked_by: { type: DataTypes.STRING(64), allowNull: true },
        last_error: { type: DataTypes.TEXT, allowNull: true },
        sent_at: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        modelName: 'CampaignRewardJob',
        tableName: 'campaign_reward_jobs',
        underscored: true,
      },
    );
    return CampaignRewardJob;
  }
}
