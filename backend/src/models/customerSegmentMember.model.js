import { DataTypes, Model } from 'sequelize';

export class CustomerSegmentMember extends Model {
  static initModel(sequelize) {
    CustomerSegmentMember.init({
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      segment_id: { type: DataTypes.INTEGER, allowNull: false },
      customer_id: { type: DataTypes.INTEGER, allowNull: false },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      added_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    }, {
      sequelize,
      tableName: 'customer_segment_members',
      timestamps: false,
      underscored: true,
    });
    return CustomerSegmentMember;
  }

  static associate(models) {
    CustomerSegmentMember.belongsTo(models.CustomerSegment, { foreignKey: 'segment_id', as: 'segment' });
    CustomerSegmentMember.belongsTo(models.Customer, { foreignKey: 'customer_id', as: 'customer' });
    CustomerSegmentMember.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
  }
}

