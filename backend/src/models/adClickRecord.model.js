/**
 * @file 广告点击监测记录（Phase 2 归因底座）。
 */
import { DataTypes, Model } from 'sequelize';

export class AdClickRecord extends Model {
  static initModel(sequelize) {
    AdClickRecord.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        platform: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'unknown' },
        click_key: { type: DataTypes.STRING(512), allowNull: false },
        status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'pending' },
        raw_query: { type: DataTypes.JSON, allowNull: true },
        redirect_host: { type: DataTypes.STRING(255), allowNull: true },
      },
      {
        sequelize,
        modelName: 'AdClickRecord',
        tableName: 'ad_click_records',
        underscored: true,
        updatedAt: false,
      },
    );
    return AdClickRecord;
  }
}
