module.exports = (sequelize, DataTypes) => {
    const Parents = sequelize.define('Parents', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        mobile: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        },
        provider: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        provider_id: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        password: {
            type: DataTypes.STRING,
            allowNull: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true
        },
        otp: {
            type: DataTypes.STRING,
            allowNull: true
        },
        otp_verified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        fcm_token: {
            type: DataTypes.STRING,
            allowNull: true
        },
        country: {
            type: DataTypes.STRING,
            allowNull: true
        },
        state: {
            type: DataTypes.STRING,
            allowNull: true
        },
        city: {
            type: DataTypes.STRING,
            allowNull: true
        },
        address: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        freezeTableName: true,
        tableName: 'parents',
        underscored: true
    });

    Parents.associate = function (models) {
        if (models.Schools) {
            Parents.belongsToMany(models.Schools, {
                through: models.ParentSchools, // ✅ Ensure the correct junction table is used
                foreignKey: 'parent_id',
                otherKey: 'school_id',
                as: 'schools' // ✅ Alias must match the one in `include`
            });
        }

        if (models.Students) {
            Parents.belongsToMany(models.Students, {
                through: 'ParentStudents',
                foreignKey: 'parent_id',
                otherKey: 'student_id',
                as: 'students'
            });
        }
    };


    return Parents;
};
