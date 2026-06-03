import { DataTypes, Model } from 'sequelize';

export class BrowserPushSubscription extends Model {
  static initModel(sequelize) {
    BrowserPushSubscription.init({
      id:          { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id:    { type: DataTypes.INTEGER, allowNull: false },
      user_id:      { type: DataTypes.INTEGER, allowNull: false },
      endpoint:     { type: DataTypes.TEXT, allowNull: false },
      p256dh:       { type: DataTypes.TEXT, allowNull: false },
      auth:         { type: DataTypes.TEXT, allowNull: false },
      user_agent:   { type: DataTypes.STRING(500) },
      device_name:  { type: DataTypes.STRING(100) },
      is_active:    { type: DataTypes.BOOLEAN, defaultValue: true },
      last_used_at: { type: DataTypes.DATE },
    }, {
      sequelize,
      tableName: 'browser_push_subscriptions',
      timestamps: true,
      underscored: true,
    });
    return BrowserPushSubscription;
  }

  static associate(models) {
    BrowserPushSubscription.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    BrowserPushSubscription.belongsTo(models.User, { foreignKey: 'user_id' });
  }
}

