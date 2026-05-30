import { DataTypes, Model } from 'sequelize';

export class SmsSendLog extends Model {
  static initModel(sequelize) {
    SmsSendLog.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        task_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        phone: { type: DataTypes.STRING(20), allowNull: false },
        template_code: { type: DataTypes.STRING(50), allowNull: false },
        template_params: { type: DataTypes.JSON, allowNull: true },
        sign_name: { type: DataTypes.STRING(50), allowNull: false },
        aliyun_biz_id: { type: DataTypes.STRING(100), allowNull: true },
        status: {
          type: DataTypes.ENUM('pending', 'success', 'failed'),
          allowNull: false,
          defaultValue: 'pending',
        },
        error_msg: { type: DataTypes.STRING(500), allowNull: true },
        sent_at: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        modelName: 'SmsSendLog',
        tableName: 'sms_send_logs',
        createdAt: 'created_at',
        updatedAt: false,
      },
    );
    return SmsSendLog;
  }
}
