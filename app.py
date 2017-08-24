#!/usr/bin/env python
from threading import Lock
from flask import Flask, render_template, session, request
from flask_socketio import SocketIO, emit, join_room, leave_room, \
    close_room, rooms, disconnect

# Set this variable to "threading", "eventlet" or "gevent" to test the
# different async modes, or leave it set to None for the application to choose
# the best option based on installed packages.
async_mode = None

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, async_mode=async_mode)
thread = None
thread_lock = Lock()


@app.route('/')
def index():
    session["room_number"] = None
    return render_template('design.html', async_mode=socketio.async_mode)


@app.route('/<room>')
def add_user(room):
    session["room_number"] = room
    print(room)
    return render_template('design.html', async_mode=socketio.async_mode)


@socketio.on('connect', namespace='/process')
def connect():
    if not session["room_number"]:
        session['room_number'] = request.sid
        join_room(session["room_number"])
        print("Alone")
        emit('response',{'data': "You are alone in room #"+session["room_number"]},room=session['room_number'])
    else:
        # auto join the room from the url
        print("Group")
        emit('response',{'data': "Someone joined room #"+session["room_number"]},room=session['room_number'])
        socketio.sleep(1)
        emit('sync_time_request', room=session["room_number"])
        join_room(session["room_number"])
        emit('response',{'data': "You are NOT alone in room #"+session["room_number"]})


@socketio.on('disconnect', namespace='/process')
def disconnect():
    leave_room(session["room_number"])
    print(request.sid, "left room", session["room_number"])
    emit('response',
         {"data":"Someone Disconnected"},
         room=session["room_number"])
    print('Client disconnected', request.sid)


@socketio.on('sync_time_event', namespace='/process')
def sync_time_event(message):
    print("Time Received")
    emit('sync_time_response', {'time': message['time'], 'paused': message["paused"], 'session': message["session"]}, room=session['room_number'] )


@socketio.on('playtoggle_event', namespace='/process')
def playtoggle_event(message):
    print("Sent Pause Signal")
    # send_room_message({"data":"playpause", "room":message['room']})
    emit('playtoggle_response', {"data":"sent"}, room=session["room_number"])


@socketio.on('broadcast_event', namespace='/process')
def broadcast_message(message):
    emit('response',{'data': message['data']}, broadcast=True)


@socketio.on("notification_event", namespace="/process")
def notification_event(message):
    emit("notification_response", {"title":message["title"], "body":message["body"]}, room=session['room_number'])


@socketio.on('my_ping', namespace='/process')
def ping_pong():
    emit('my_pong')


if __name__ == '__main__':
    socketio.run(app, debug=True)
