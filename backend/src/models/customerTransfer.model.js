/**
 * @file 客户转移批次（离职继承 / 重新分配）。
 */
import { DataTypes, Model } from 'sequelize';

export class CustomerTransfer extends Model {
  static initModel(sequelize) {
    CustomerTransfer.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        from_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        to_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        initiated_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        reason: {
          type: DataTypes.ENUM('resigned', 'reassign'),
          allowNull: false,
          defaultValue: 'resigned',
        },
        status: {
          type: DataTypes.ENUM('pending', 'processing', 'done', 'partial', 'failed'),
          allowNull: false,
          defaultValue: 'pending',
        },
        total_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        success_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        failed_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        detail_json: { type: DataTypes.JSON, allowNull: true },
        started_at: { type: DataTypes.DATE, allowNull: true },
        finished_at: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        modelName: 'CustomerTransfer',
        tableName: 'customer_transfers',
        underscored: true,
        timestamps: true,
      },
    );
    return CustomerTransfer;
  }
}
