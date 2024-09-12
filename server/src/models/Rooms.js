// id: roomId,
//         name: roomData.roomName,
//         creator: nickname,
//         isPrivate: roomData.isPrivate,
//         password: roomData.password,
//         users: [],
//         usersData: [],
//         drawings: [],


const mongose = require("mongoose");

const RoomsModel = new mongose.Schema({ 
    id: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    isPrivate: {
        type: Boolean,
        required: true
    },
    password: {
        type: String
    },
    users: [{
        type: String
    }]
});

const Rooms = mongose.model("rooms", RoomsModel);
module.exports = Rooms;
