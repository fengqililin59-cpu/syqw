/**
 * @file 仪表盘配置模型
 *
 * 每个租户可自定义仪表盘 Widget 的显示/隐藏和排序。
 * 配置以 JSON 数组存储在 config 字段中。
 */
import { DataTypes } from 'sequelize';

export class DashboardConfig {
  /** @param {import('sequelize').Sequelize} sequelize */
  static initModel(sequelize) {
    DashboardConfig.model = sequelize.define(
      'DashboardConfig',
      {
        id:        { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        config:    { type: DataTypes.JSON, allowNull: false },
      },
      {
        tableName: 'tenant_dashboard_configs',
        timestamps: true,
        underscored: true,
      },
    );
    return DashboardConfig.model;
  }
}
