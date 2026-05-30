/**
 * @file 广告转化事件（含回传结果）。
 */
import { DataTypes, Model } from 'sequelize';

export class AdConversionEvent extends Model {
  static initModel(sequelize) {
    AdConversionEvent.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        ad_click_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        platform: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'unknown' },
        click_key: { type: DataTypes.STRING(512), allowNull: false },
        event_type: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'register' },
        event_value: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        report_status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'pending' },
        report_response: { type: DataTypes.TEXT, allowNull: true },
      },
      {
        sequelize,
        modelName: 'AdConversionEvent',
        tableName: 'ad_conversion_events',
        underscored: true,
        updatedAt: false,
      },
    );
    return AdConversionEvent;
  }
}
