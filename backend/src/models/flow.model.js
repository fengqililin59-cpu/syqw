import { DataTypes, Model } from 'sequelize';

export class Flow extends Model {
  static initModel(sequelize) {
    Flow.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        name: { type: DataTypes.STRING(100), allowNull: false },
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        modelName: 'Flow',
        tableName: 'flows',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
    return Flow;
  }
}
