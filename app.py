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

# rooms = {}      # TODO implement later AND RENAME

# users_online = {}       # {room# : users online}


@app.route('/')
def index():
    return render_template('index.html', async_mode=socketio.async_mode)


@app.route('/<room>')
def add_user(room):
    return render_template('index.html', async_mode=socketio.async_mode)

# def background_thread():
#     """Example of how to send server generated events to clients."""
#     while True:
#         socketio.sleep(10)
#         socketio.emit('response',
#                       {'data': 'Server generated event'},
#                       namespace='/process')
@socketio.on('connect', namespace='/process')
def connect():
    session['room_number'] = request.sid

    emit('room_number_response', {"room_number":request.sid})

# @socketio.on('disconnect_request', namespace='/process')
# def disconnect_request():
#     print("disconnect_request", request.sid)
#     emit('response',
#          {"data":"data"},
#          room=session["room_number"])
#     disconnect()

@socketio.on('disconnect', namespace='/process')
def disconnect():
    emit('response',
         {"data":"Someone Disconnected"},
         room=session["room_number"])
    print('Client disconnected', request.sid)

@socketio.on('message_event', namespace='/process')
def test_message(message):
    emit('response', {'data': message['data']})

@socketio.on('sync_time_event', namespace='/process')
def sync_time_event(message):
    emit('sync_time_response', {'time': message['time'], 'paused': message["paused"]})

@socketio.on('playtoggle_event', namespace='/process')
def playtoggle_event(message):
    print("Sent Pause Signal")
    # send_room_message({"data":"playpause", "room":message['room']})
    emit('playtoggle_response', {"data":"sent"}, room=message["room"])


@socketio.on('broadcast_event', namespace='/process')
def broadcast_message(message):
    emit('response',{'data': message['data']}, broadcast=True)


@socketio.on('join_event', namespace='/process')
def join(message):
    room = message["room"]
    session["room_number"] = room
    # send_room_message({"data":"new user requesting time", "room":message['room']})
    emit('time_request', room=message["room"])
    join_room(message['room'])
    emit('response', {'data': 'In rooms: ' + ', '.join(rooms())})

    send_room_message({"data":"Someone has joined the room", "room":message['room']})


@socketio.on('room_event', namespace='/process')
def send_room_message(message):
    # session['receive_count'] = session.get('receive_count', 0)
    emit('response',
         {'data': message['data']},
         room=message['room'])


@socketio.on('my_ping', namespace='/process')
def ping_pong():
    emit('my_pong')


if __name__ == '__main__':
    socketio.run(app, debug=True)
