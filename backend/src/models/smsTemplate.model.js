import { DataTypes, Model } from 'sequelize';

export class SmsTemplate extends Model {
  static initModel(sequelize) {
    SmsTemplate.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        name: { type: DataTypes.STRING(100), allowNull: false },
        aliyun_template_code: { type: DataTypes.STRING(50), allowNull: false },
        content_preview: { type: DataTypes.TEXT, allowNull: false },
        variables: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
        sign_name: { type: DataTypes.STRING(50), allowNull: false },
        status: {
          type: DataTypes.ENUM('active', 'disabled'),
          allowNull: false,
          defaultValue: 'active',
        },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      },
      {
        sequelize,
        modelName: 'SmsTemplate',
        tableName: 'sms_templates',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
    return SmsTemplate;
  }
}
