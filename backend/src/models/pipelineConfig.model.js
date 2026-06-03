/**
 * @file 租户销售管道配置模型
 *
 * 每个租户可自定义一套销售管道阶段，通过 stages JSON 字段存储。
 * 默认6阶段：新线索 → 意向确认 → 方案报价 → 商务谈判 → 成交 → 流失
 */
import { DataTypes } from 'sequelize';

export class PipelineConfig {
  /** @param {import('sequelize').Sequelize} sequelize */
  static initModel(sequelize) {
    PipelineConfig.model = sequelize.define(
      'PipelineConfig',
      {
        id:        { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        stages:    { type: DataTypes.JSON, allowNull: false },
      },
      {
        tableName: 'tenant_pipeline_configs',
        timestamps: true,
        underscored: true,
      },
    );
    return PipelineConfig.model;
  }
}
