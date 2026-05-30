/**
 * @file 渠道活码（员工活码 / 预留群活码）。
 */
import { DataTypes, Model } from 'sequelize';

export class WeworkChannel extends Model {
  static initModel(sequelize) {
    WeworkChannel.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        group_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        name: { type: DataTypes.STRING(128), allowNull: false },
        type: {
          type: DataTypes.STRING(32),
          allowNull: false,
          defaultValue: 'employee',
        },
        state: { type: DataTypes.STRING(128), allowNull: true },
        wework_config_id: { type: DataTypes.STRING(64), allowNull: true },
        config: { type: DataTypes.JSON, allowNull: true },
      },
      {
        sequelize,
        modelName: 'WeworkChannel',
        tableName: 'wework_channels',
        underscored: true,
      },
    );
    return WeworkChannel;
  }
}
