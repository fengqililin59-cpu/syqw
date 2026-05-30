/**
 * @file 按日广告消耗（成本打通）。
 */
import { DataTypes, Model } from 'sequelize';

export class AdSpendDaily extends Model {
  static initModel(sequelize) {
    AdSpendDaily.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        stat_date: { type: DataTypes.DATEONLY, allowNull: false },
        platform: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'unknown' },
        external_campaign_id: { type: DataTypes.STRING(128), allowNull: false, defaultValue: '' },
        campaign_name: { type: DataTypes.STRING(255), allowNull: true },
        spend_cny: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        impressions: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        platform_clicks: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        source: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'manual' },
        meta: { type: DataTypes.JSON, allowNull: true },
      },
      {
        sequelize,
        modelName: 'AdSpendDaily',
        tableName: 'ad_spend_daily',
        underscored: true,
      },
    );
    return AdSpendDaily;
  }
}
