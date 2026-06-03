import { DataTypes, Model } from 'sequelize';

export class MarketingOptOut extends Model {
  static initModel(sequelize) {
    MarketingOptOut.init({
      id:           { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      tenant_id:     { type: DataTypes.BIGINT, allowNull: false },
      customer_id:   { type: DataTypes.BIGINT },
      contact_value: { type: DataTypes.STRING(500), allowNull: false },
      reason:        { type: DataTypes.STRING(500) },
    }, {
      sequelize,
      tableName: 'marketing_optouts',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: false,
      indexes: [
        { fields: ['tenant_id'] },
        { fields: ['customer_id'] },
        { fields: ['contact_value(100)'], unique: true },
      ],
    });
    return MarketingOptOut;
  }

  static associate(models) {
    MarketingOptOut.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    MarketingOptOut.belongsTo(models.Customer, { foreignKey: 'customer_id' });
  }
}
