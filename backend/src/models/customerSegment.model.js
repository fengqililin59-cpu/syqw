import { DataTypes, Model } from 'sequelize';

export class CustomerSegment extends Model {
  static initModel(sequelize) {
    CustomerSegment.init({
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.STRING(500) },
      rules: { type: DataTypes.JSON, allowNull: false },
      match_type: { type: DataTypes.ENUM('all', 'any'), defaultValue: 'all' },
      color_tag: { type: DataTypes.STRING(20) },
      icon: { type: DataTypes.STRING(50) },
      is_auto_refresh: { type: DataTypes.BOOLEAN, defaultValue: false },
      member_count: { type: DataTypes.INTEGER, defaultValue: 0 },
      last_refreshed_at: { type: DataTypes.DATE },
      created_by: { type: DataTypes.INTEGER },
    }, {
      sequelize,
      tableName: 'customer_segments',
      timestamps: true,
      underscored: true,
    });
    return CustomerSegment;
  }

  static associate(models) {
    CustomerSegment.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    CustomerSegment.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    CustomerSegment.hasMany(models.CustomerSegmentMember, { foreignKey: 'segment_id', as: 'members' });
  }
}

