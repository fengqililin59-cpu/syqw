/**
 * @file 渠道活码分组（租户内归类）。
 */
import { DataTypes, Model } from 'sequelize';

export class WeworkChannelGroup extends Model {
  static initModel(sequelize) {
    WeworkChannelGroup.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        name: { type: DataTypes.STRING(64), allowNull: false },
        sort: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      },
      {
        sequelize,
        modelName: 'WeworkChannelGroup',
        tableName: 'wework_channel_groups',
        underscored: true,
      },
    );
    return WeworkChannelGroup;
  }
}
