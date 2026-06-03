import { DataTypes, Model } from 'sequelize';

export class MarketingMessage extends Model {
  static initModel(sequelize) {
    MarketingMessage.init({
      id:             { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      tenant_id:       { type: DataTypes.BIGINT, allowNull: false },
      campaign_id:     { type: DataTypes.BIGINT, allowNull: false },
      customer_id:     { type: DataTypes.BIGINT },
      contact_value:   { type: DataTypes.STRING(500), allowNull: false },
      subject:         { type: DataTypes.STRING(300) },
      content:         { type: DataTypes.TEXT },
      status:          { type: DataTypes.ENUM('pending','sent','failed','opened','clicked','bounced'), defaultValue: 'pending' },
      error_message:   { type: DataTypes.TEXT },
      sent_at:         { type: DataTypes.DATE },
      opened_at:       { type: DataTypes.DATE },
      clicked_at:      { type: DataTypes.DATE },
      track_open_id:   { type: DataTypes.STRING(64) },
      track_click_id:  { type: DataTypes.STRING(64) },
    }, {
      sequelize,
      tableName: 'marketing_messages',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: false,
      indexes: [
        { fields: ['tenant_id'] },
        { fields: ['campaign_id'] },
        { fields: ['customer_id'] },
        { fields: ['status'] },
        { fields: ['contact_value(100)'] },
      ],
    });
    return MarketingMessage;
  }

  static associate(models) {
    MarketingMessage.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    MarketingMessage.belongsTo(models.MarketingCampaign, { foreignKey: 'campaign_id', as: 'campaign' });
    MarketingMessage.belongsTo(models.Customer, { foreignKey: 'customer_id' });
  }
}
