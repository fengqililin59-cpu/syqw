/**
 * @file 广告 ROI 日级预聚合。
 */
import { DataTypes, Model } from 'sequelize';

export class AggAdsRoiDaily extends Model {
  static initModel(sequelize) {
    AggAdsRoiDaily.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        stat_date: { type: DataTypes.DATEONLY, allowNull: false },
        platform: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'unknown' },
        clicks: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        conversions: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        reported: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        conversion_value: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      },
      {
        sequelize,
        modelName: 'AggAdsRoiDaily',
        tableName: 'agg_ads_roi_daily',
        underscored: true,
      },
    );
    return AggAdsRoiDaily;
  }
}
