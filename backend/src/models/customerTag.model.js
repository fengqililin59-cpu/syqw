/**
 * @file 客户-标签中间表模型。
 */
import { DataTypes, Model } from 'sequelize';

export class CustomerTag extends Model {
  static initModel(sequelize) {
    CustomerTag.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        tag_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        modelName: 'CustomerTag',
        tableName: 'customer_tags',
        updatedAt: false,
      }
    );
    return CustomerTag;
  }
}
