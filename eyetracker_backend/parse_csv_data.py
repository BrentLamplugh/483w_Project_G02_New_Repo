# imports:      
# import pandas to handle csv parsing
from flask import Flask, jsonify, request
import pandas as pd
import io

# Flask app setup
app = Flask(__name__)
@app.route('/upload', methods=['POST'])

def parse_csv():

    file = request.files['file']  # 'file' must match the key from frontend
    df = pd.read_csv(io.BytesIO(file.read()))  # read directly from memory, no temp file needed

    """ Parsing """
    # Heatmap
    hm_df = df[['MEDIA_ID', 'BPOGX', 'BPOGY', 'BPOGV', 'TIME']] # df of exact data values needed for heatmap
    hm_df = hm_df[hm_df['BPOGV'] == 1] # filter for valid gaze points - cleaning data; only want valid gaze points
    hm_df = hm_df.drop(columns=['BPOGV'])  # drop validity column after filtering
    hm_df = hm_df.rename(columns={'MEDIA_ID': 'id', 'BPOGX': 'x', 'BPOGY': 'y', 'TIME': 'timestamp'}) # rename columns for clarity

    # Scanpath
    sp_df = df[['MEDIA_ID', 'FPOGX', 'FPOGY', 'FPOGID', 'FPOGV', 'FPOGS', 'TIME']] # df of exact data values needed for scanpath
    sp_df = sp_df[sp_df['FPOGV'] == 1] # filter for valid gaze points
    sp_df = sp_df.drop(columns=['FPOGV'])  # drop validity column after filtering
    sp_df = sp_df.rename(columns={'MEDIA_ID': 'id', 'FPOGX': 'x', 'FPOGY': 'y', 'FPOGID': 'gaze_id', 'FPOGS': 'gaze_start_time', 'TIME': 'timestamp'}) # rename columns for clarity


    # Fiaxtion Map
    fm_df = df[['MEDIA_ID', 'FPOGX', 'FPOGY', 'FPOGD', 'FPOGID', 'FPOGV']] # df of exact data values needed for fixation map
    fm_df = fm_df[fm_df['FPOGV'] == 1] # filter for valid gaze points
    fm_df = fm_df.drop(columns=['FPOGV'])  # drop validity column after filtering
    fm_df = fm_df.rename(columns={'MEDIA_ID': 'id', 'FPOGX': 'x', 'FPOGY': 'y', 'FPOGD': 'duration', 'FPOGID': 'gaze_id'}) # rename columns for clarity

    # Give the parsed data back to React in JSON format
    return jsonify({
        "heatmap": hm_df.to_dict(orient='records'),
        "scanpath": sp_df.to_dict(orient='records'),
        "fixation_map": fm_df.to_dict(orient='records')
    })


# Test the Flask app
if __name__ == "__main__":
    app.run(debug=True)
