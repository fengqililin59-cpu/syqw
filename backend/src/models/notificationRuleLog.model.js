import { DataTypes, Model } from 'sequelize';

export class NotificationRuleLog extends Model {
  static initModel(sequelize) {
    NotificationRuleLog.init({
      id:               { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id:         { type: DataTypes.INTEGER, allowNull: false },
      rule_id:           { type: DataTypes.INTEGER, allowNull: false },
      recipients_count:  { type: DataTypes.INTEGER, defaultValue: 0 },
      channels_used:     { type: DataTypes.JSON },
      status:            { type: DataTypes.ENUM('success', 'partial', 'failed'), defaultValue: 'success' },
      error_message:     { type: DataTypes.TEXT },
    }, {
      sequelize,
      tableName: 'notification_rule_logs',
      timestamps: true,
      underscored: true,
      createdAt: 'triggered_at',
      updatedAt: false,
    });
    return NotificationRuleLog;
  }

  static associate(models) {
    NotificationRuleLog.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    NotificationRuleLog.belongsTo(models.NotificationRule, { foreignKey: 'rule_id', as: 'rule' });
  }
}

