/**
 * @file 客户群成员模型。
 */
import { DataTypes, Model } from 'sequelize';

export class GroupMember extends Model {
  static initModel(sequelize) {
    GroupMember.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        group_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        external_userid: { type: DataTypes.STRING(64), allowNull: true },
        wework_userid: { type: DataTypes.STRING(64), allowNull: true },
        member_type: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        join_time: { type: DataTypes.DATE, allowNull: true },
        join_scene: { type: DataTypes.TINYINT, allowNull: true },
      },
      {
        sequelize,
        modelName: 'GroupMember',
        tableName: 'group_members',
        underscored: true,
        timestamps: false,
      },
    );
    return GroupMember;
  }
}
