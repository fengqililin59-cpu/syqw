/**
 * @file 企微客户会话消息（接收消息回调解密后入库）。
 */
import { DataTypes, Model } from 'sequelize';

export class WeworkCustomerMessage extends Model {
  static initModel(sequelize) {
    WeworkCustomerMessage.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        msg_id: { type: DataTypes.STRING(64), allowNull: false },
        external_userid: { type: DataTypes.STRING(64), allowNull: true },
        staff_userid: { type: DataTypes.STRING(64), allowNull: true },
        direction: { type: DataTypes.STRING(16), allowNull: false },
        msg_type: { type: DataTypes.STRING(32), allowNull: false },
        content: { type: DataTypes.TEXT, allowNull: true },
        raw_plain_xml: { type: DataTypes.TEXT('medium'), allowNull: true },
        msg_time: { type: DataTypes.DATE, allowNull: false },
      },
      {
        sequelize,
        modelName: 'WeworkCustomerMessage',
        tableName: 'wework_customer_messages',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
      },
    );
    return WeworkCustomerMessage;
  }
}
