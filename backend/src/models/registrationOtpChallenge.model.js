/**
 * @file 注册验证码挑战（邮箱/短信），与租户无关的全局表。
 */
import { DataTypes, Model } from 'sequelize';

export class RegistrationOtpChallenge extends Model {
  static initModel(sequelize) {
    RegistrationOtpChallenge.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        channel: { type: DataTypes.ENUM('email', 'sms'), allowNull: false },
        target: { type: DataTypes.STRING(191), allowNull: false },
        code_hash: { type: DataTypes.CHAR(64), allowNull: false },
        expires_at: { type: DataTypes.DATE, allowNull: false },
        consumed_at: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        modelName: 'RegistrationOtpChallenge',
        tableName: 'registration_otp_challenges',
        timestamps: true,
        updatedAt: false,
        createdAt: 'created_at',
      },
    );
    return RegistrationOtpChallenge;
  }
}
