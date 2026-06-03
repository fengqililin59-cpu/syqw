import { DataTypes, Model } from 'sequelize';

export class MessageTemplate extends Model {
  static initModel(sequelize) {
    MessageTemplate.init({
      id:           { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      tenant_id:     { type: DataTypes.BIGINT, allowNull: false },
      name:          { type: DataTypes.STRING(200), allowNull: false },
      type:          { type: DataTypes.ENUM('email','sms','wechat'), defaultValue: 'email' },
      subject:       { type: DataTypes.STRING(300) },
      content:       { type: DataTypes.TEXT, allowNull: false },
      variables:     { type: DataTypes.JSON },
      is_active:     { type: DataTypes.BOOLEAN, defaultValue: true },
      created_by:    { type: DataTypes.BIGINT },
    }, {
      sequelize,
      tableName: 'message_templates',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['tenant_id'] },
        { fields: ['type'] },
      ],
    });
    return MessageTemplate;
  }

  static associate(models) {
    MessageTemplate.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    MessageTemplate.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  }
}
