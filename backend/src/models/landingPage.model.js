import { DataTypes, Model } from 'sequelize';

export class LandingPage extends Model {
  static initModel(sequelize) {
    LandingPage.init({
      id:              { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      tenant_id:        { type: DataTypes.BIGINT, allowNull: false },
      title:            { type: DataTypes.STRING(200), allowNull: false },
      slug:             { type: DataTypes.STRING(100), allowNull: false },
      description:      { type: DataTypes.STRING(500) },
      status:           { type: DataTypes.ENUM('draft','published','archived'), defaultValue: 'draft' },
      template:         { type: DataTypes.STRING(50), defaultValue: 'default' },
      content:          { type: DataTypes.JSON, allowNull: false },
      custom_css:       { type: DataTypes.TEXT },
      meta_title:       { type: DataTypes.STRING(200) },
      og_image:         { type: DataTypes.STRING(500) },
      bg_color:         { type: DataTypes.STRING(20), defaultValue: '#ffffff' },
      primary_color:    { type: DataTypes.STRING(20), defaultValue: '#534AB7' },
      logo_url:         { type: DataTypes.STRING(500) },
      favicon_url:      { type: DataTypes.STRING(500) },
      enable_form:      { type: DataTypes.BOOLEAN, defaultValue: true },
      form_title:       { type: DataTypes.STRING(200) },
      form_fields:      { type: DataTypes.JSON },
      submit_btn_text:  { type: DataTypes.STRING(50), defaultValue: '立即咨询' },
      success_msg:      { type: DataTypes.STRING(500), defaultValue: '提交成功，我们会尽快联系您！' },
      redirect_url:     { type: DataTypes.STRING(500) },
      qrcode_url:       { type: DataTypes.STRING(500) },
      qrcode_text:      { type: DataTypes.STRING(200) },
      view_count:       { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
      submit_count:     { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
      published_at:     { type: DataTypes.DATE },
      created_by:       { type: DataTypes.BIGINT },
    }, {
      sequelize,
      tableName: 'landing_pages',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['tenant_id'] },
        { fields: ['status'] },
        { unique: true, fields: ['tenant_id', 'slug'] },
      ],
    });
    return LandingPage;
  }

  static associate(models) {
    LandingPage.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    LandingPage.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    LandingPage.hasMany(models.LandingSubmission, { foreignKey: 'landing_id', as: 'submissions' });
  }
}

export class LandingSubmission extends Model {
  static initModel(sequelize) {
    LandingSubmission.init({
      id:              { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      tenant_id:        { type: DataTypes.BIGINT, allowNull: false },
      landing_id:       { type: DataTypes.BIGINT, allowNull: false },
      customer_id:      { type: DataTypes.BIGINT },
      data:             { type: DataTypes.JSON, allowNull: false },
      ip:               { type: DataTypes.STRING(45) },
      user_agent:       { type: DataTypes.STRING(500) },
      referer:          { type: DataTypes.STRING(500) },
      utm_source:       { type: DataTypes.STRING(200) },
      utm_medium:       { type: DataTypes.STRING(200) },
      utm_campaign:     { type: DataTypes.STRING(200) },
    }, {
      sequelize,
      tableName: 'landing_submissions',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: false,
      indexes: [
        { fields: ['tenant_id'] },
        { fields: ['landing_id'] },
        { fields: ['customer_id'] },
      ],
    });
    return LandingSubmission;
  }

  static associate(models) {
    LandingSubmission.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    LandingSubmission.belongsTo(models.LandingPage, { foreignKey: 'landing_id', as: 'landing' });
    LandingSubmission.belongsTo(models.Customer, { foreignKey: 'customer_id' });
  }
}
