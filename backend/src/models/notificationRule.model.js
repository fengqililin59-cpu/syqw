import { DataTypes, Model } from 'sequelize';

export class NotificationRule extends Model {
  static initModel(sequelize) {
    NotificationRule.init({
      id:              { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id:        { type: DataTypes.INTEGER, allowNull: false },
      name:             { type: DataTypes.STRING(100), allowNull: false },
      description:      { type: DataTypes.STRING(500) },
      enabled:          { type: DataTypes.BOOLEAN, defaultValue: true },
      trigger_type:     { type: DataTypes.STRING(32), allowNull: false },
      trigger_config:   { type: DataTypes.JSON, allowNull: false },
      channels:         { type: DataTypes.JSON, allowNull: false },
      recipient_type:   { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'specific' },
      recipient_config: { type: DataTypes.JSON },
      template:         { type: DataTypes.JSON, allowNull: false },
      priority:         { type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'), defaultValue: 'normal' },
      cooldown_minutes: { type: DataTypes.INTEGER, defaultValue: 60 },
      max_per_run:      { type: DataTypes.INTEGER, defaultValue: 50 },
      last_triggered_at:{ type: DataTypes.DATE },
      trigger_count:    { type: DataTypes.INTEGER, defaultValue: 0 },
      created_by:       { type: DataTypes.INTEGER },
    }, {
      sequelize,
      tableName: 'notification_rules',
      timestamps: true,
      underscored: true,
    });
    return NotificationRule;
  }

  static associate(models) {
    NotificationRule.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    NotificationRule.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  }
}

