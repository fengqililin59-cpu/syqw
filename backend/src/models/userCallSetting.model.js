/**
 * @file 用户外呼设置模型。
 */
import { DataTypes, Model } from 'sequelize';

export class UserCallSetting extends Model {
  static initModel(sequelize) {
    UserCallSetting.init(
      {
        user_id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, allowNull: false },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        dial_mode: {
          type: DataTypes.ENUM('phone', 'webrtc', 'native'),
          allowNull: false,
          defaultValue: 'native',
        },
        phone_number: { type: DataTypes.STRING(20), allowNull: true },
        is_available: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      },
      { sequelize, modelName: 'UserCallSetting', tableName: 'user_call_settings', updatedAt: 'updated_at', createdAt: false },
    );
    return UserCallSetting;
  }
}
