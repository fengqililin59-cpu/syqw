/**
 * @file 统一营销事件表（漏斗、与投放归因对齐）。
 */
import { DataTypes, Model } from 'sequelize';

export class MarketingEvent extends Model {
  static initModel(sequelize) {
    MarketingEvent.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        session_id: { type: DataTypes.STRING(64), allowNull: true },
        ad_hit: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        event_key: { type: DataTypes.STRING(64), allowNull: false },
        properties: { type: DataTypes.JSON, allowNull: true },
        source: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'web' },
        ip: { type: DataTypes.STRING(45), allowNull: true },
        user_agent: { type: DataTypes.STRING(512), allowNull: true },
      },
      {
        sequelize,
        modelName: 'MarketingEvent',
        tableName: 'marketing_events',
        underscored: true,
        updatedAt: false,
      },
    );
    return MarketingEvent;
  }
}
