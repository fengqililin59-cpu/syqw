/**
 * @file 渠道（UTM）日级预聚合。
 */
import { DataTypes, Model } from 'sequelize';

export class AggChannelDaily extends Model {
  static initModel(sequelize) {
    AggChannelDaily.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        stat_date: { type: DataTypes.DATEONLY, allowNull: false },
        source_key: { type: DataTypes.STRING(100), allowNull: false },
        visit_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        session_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        user_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      },
      {
        sequelize,
        modelName: 'AggChannelDaily',
        tableName: 'agg_channel_daily',
        underscored: true,
      },
    );
    return AggChannelDaily;
  }
}
