/**
 * @file 单次邀请明细（受邀客户维度唯一）。
 */
import { DataTypes, Model } from 'sequelize';

export class InviteRecord extends Model {
  static initModel(sequelize) {
    InviteRecord.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        campaign_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        inviter_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        invitee_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        invitee_external_userid: { type: DataTypes.STRING(64), allowNull: true },
      },
      {
        sequelize,
        modelName: 'InviteRecord',
        tableName: 'invite_records',
        underscored: true,
        updatedAt: false,
      },
    );
    return InviteRecord;
  }
}
