/**
 * @file 用户参与活动记录（专属邀请码）。
 */
import { DataTypes, Model } from 'sequelize';

export class CampaignEnrollment extends Model {
  static initModel(sequelize) {
    CampaignEnrollment.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        campaign_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        invite_code: { type: DataTypes.STRING(32), allowNull: false },
        invited_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        achieved_milestone_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        is_achieved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        reward_sent_at: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        modelName: 'CampaignEnrollment',
        tableName: 'campaign_enrollments',
        underscored: true,
      },
    );
    return CampaignEnrollment;
  }
}
