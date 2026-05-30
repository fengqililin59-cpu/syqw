/**
 * @file 全渠道配置（企微、抖音等）。
 */
import { DataTypes, Model } from 'sequelize';

export class OmniChannel extends Model {
  static initModel(sequelize) {
    OmniChannel.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        code: { type: DataTypes.STRING(32), allowNull: false },
        name: { type: DataTypes.STRING(64), allowNull: false },
        status: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
        config_json: { type: DataTypes.JSON, allowNull: true },
      },
      {
        sequelize,
        modelName: 'OmniChannel',
        tableName: 'omni_channels',
        underscored: true,
      },
    );
    return OmniChannel;
  }
}
