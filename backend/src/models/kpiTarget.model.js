/**
 * @file KpiTarget 模型 — KPI 目标配置
 */
import { DataTypes, Model } from 'sequelize';

export class KpiTarget extends Model {
  static initModel(sequelize) {
    KpiTarget.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        tenant_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          comment: 'NULL=全员默认目标',
        },
        dimension: {
          type: DataTypes.STRING(32),
          allowNull: false,
          comment: 'followups/calls/revenue/orders/new_customers',
        },
        target_value: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
        },
        period: {
          type: DataTypes.STRING(16),
          allowNull: false,
          defaultValue: 'daily',
          comment: 'daily/weekly/monthly',
        },
      },
      {
        sequelize,
        modelName: 'KpiTarget',
        tableName: 'kpi_targets',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          {
            unique: true,
            fields: ['tenant_id', 'user_id', 'dimension', 'period'],
          },
        ],
      },
    );
    return KpiTarget;
  }
}

export default KpiTarget;
