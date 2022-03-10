const express = require('express')
const WebSocketServer = require('ws').WebSocketServer;
const http = require('http');
const GameState = require('./GameState');

const port = 8080;
const host = "localhost";

const app = express();

let rooms = {}

let state = GameState();

function createRoom(id){
    rooms[id] = {history: [], w: null, b:null, game_status: state.WAITING_FOR_PLAYERS};
}





app.use(express.json());
app.post("/create_room",(req,res)=>{
    createRoom(req.body.roomID);
    res.end(JSON.stringify({type:"room_created", roomID:req.body.roomID}));

});

app.use("/room/:id", express.static("./build"));
app.use(express.static("./build"));


const server = http.createServer(app);


const wss = new WebSocketServer({server: server});



wss.on('connection', (socket) => {
    socket.on('error', function (){
        console.log("closed");

    });
    socket.on('message', function message(data) {
        let message = JSON.parse(data);
        console.log(message);
        if(message.type === "join_room"){
            joinRoom(message.roomID,socket,message.side)
            let room = rooms[message.roomID];
            if(room && room.w && room.b){
                startGame(room);
            }

        }
        if(message.type === "chess_move"){
            let roomID = message.roomID;
            let move = message.move;
            let side = message.side;
            let room = rooms[roomID];
            if(!room) console.log("no room with roomID: "+ roomID);
            let opponent = side === "w"? "b":"w";
            room[opponent].send(JSON.stringify(message));
            room.history.push(move);
        }

        if(message.type === "game_end"){
            endGame(rooms[message.roomID], message.state);
            setTimeout((roomID)=>softDeleteRoom(roomID), 300000, message.roomID);
        }
        if(message.type === "rematch_request"){
            
        }
    });

});

function joinRoom(roomID,socket,side){
    if(!rooms.hasOwnProperty(roomID)) socket.send(JSON.stringify({type:"error" ,message:"No room with this id"}));
    let room = rooms[roomID];
    if(side === "any"){
        if(room.w === null){
            room.w = socket;
            socket.send(JSON.stringify({type:"room_joined" , roomID: roomID, side:"w"}));
        }else if( room.b === null){
            room.b = socket;
            socket.send(JSON.stringify({type:"room_joined" , roomID: roomID, side:"b"}));
        }else{
            socket.send(JSON.stringify({type:"error" ,message:"No slots in room with this id"}));
        }
    }
    //////////////////////////////////
    if(side === "w") {
        if(room.w !== null) socket.send(JSON.stringify({type: "error", message: "White slot is already taken"}));
        room.w = socket;

        socket.send(JSON.stringify({type:"room_joined" , roomID: roomID, side:"w"}));
    }
    //////////////////////////////////
    if(side === "b") {
        if(room.b !== null) socket.send(JSON.stringify({type: "error", message: "Black slot is already taken"}));
        room.b = socket;
        socket.send(JSON.stringify({type:"room_joined" , roomID: roomID, side:"b"}));
    }
}
function endGame(roomID, state) {
    let room = rooms[roomID];
    if(!room){
        console.log("no room with such roomID:",roomID);
        return;
    }
    room.game_status = state;
}

function startGame(room) {
    let type = "game_started";

    room.w.send(JSON.stringify({type, roomID:room.roomID, side:"w"}))
    room.b.send(JSON.stringify({type, roomID:room.roomID, side:"b"}))
    room.game_status = state.IN_PROCESS;
}

function softDeleteRoom(roomID){
    let room = rooms[roomID];
    if(!room) {
        console.log("no room with ID:", roomID);
        return;
    }

    if(room.game_status.isGameFinished()){
        room.w.send(JSON.stringify({type:"room_deleted", roomID}));
        room.b.send(JSON.stringify({type:"room_deleted", roomID}));
        room.w = room.b = null;
        delete rooms[roomID];
    }

}

server.listen(port,host, () => {
    console.log(`Server runs at http://${host}:${port}`);
});

