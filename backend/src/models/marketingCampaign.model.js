import { DataTypes, Model } from 'sequelize';

export class MarketingCampaign extends Model {
  static initModel(sequelize) {
    MarketingCampaign.init({
      id:            { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      tenant_id:      { type: DataTypes.BIGINT, allowNull: false },
      name:           { type: DataTypes.STRING(200), allowNull: false },
      type:           { type: DataTypes.ENUM('email','sms','wechat'), defaultValue: 'email' },
      status:         { type: DataTypes.ENUM('draft','scheduled','sending','sent','cancelled'), defaultValue: 'draft' },
      subject:        { type: DataTypes.STRING(300) },
      content:        { type: DataTypes.TEXT },
      template_id:    { type: DataTypes.BIGINT },
      target_filter:  { type: DataTypes.JSON },
      target_count:   { type: DataTypes.INTEGER, defaultValue: 0 },
      sent_count:     { type: DataTypes.INTEGER, defaultValue: 0 },
      open_count:     { type: DataTypes.INTEGER, defaultValue: 0 },
      click_count:    { type: DataTypes.INTEGER, defaultValue: 0 },
      reply_count:    { type: DataTypes.INTEGER, defaultValue: 0 },
      bounce_count:   { type: DataTypes.INTEGER, defaultValue: 0 },
      scheduled_at:   { type: DataTypes.DATE },
      sent_at:        { type: DataTypes.DATE },
      created_by:     { type: DataTypes.BIGINT },
    }, {
      sequelize,
      tableName: 'marketing_campaigns',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['tenant_id'] },
        { fields: ['status'] },
        { fields: ['type'] },
      ],
    });
    return MarketingCampaign;
  }

  static associate(models) {
    MarketingCampaign.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    MarketingCampaign.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    MarketingCampaign.hasMany(models.MarketingMessage, { foreignKey: 'campaign_id', as: 'messages' });
  }
}
